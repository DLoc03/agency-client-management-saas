<?php

namespace Tests\Feature\Finance;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-008 manual payments (docs/FINANCE_CONTRACT.md section 4.4):
 * recording rules, partial accumulation, the automatic Paid
 * transition, and deletion as an error correction.
 */
class PaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeUser(array $roles = [Role::OWNER], ?int $agencyId = null): User
    {
        return $this->makeMembershipUser($roles, $agencyId);
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    /** A sent invoice with a round total of 1000 and no payments yet. */
    private function makeSentInvoice(User $owner, array $attrs = []): Invoice
    {
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $invoice = Invoice::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $client->id,
            'status' => Invoice::STATUS_SENT,
            'sent_at' => now(),
            'subtotal' => 1000,
            'tax_amount' => 0,
            'total' => 1000,
        ], $attrs));
        $invoice->items()->create([
            'description' => 'Work', 'quantity' => 1, 'unit_price' => 1000,
            'amount' => 1000, 'sort_order' => 0,
        ]);

        return $invoice;
    }

    public function test_partial_payments_accumulate_and_full_coverage_marks_paid(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeSentInvoice($owner);

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 400, 'method' => 'bank_transfer',
        ])
            ->assertCreated()
            ->assertJsonPath('data.amount', '400.00')
            ->assertJsonPath('data.method', 'bank_transfer')
            ->assertJsonPath('data.recorded_by.id', $owner->id)
            ->assertJsonPath('data.paid_on', now()->toDateString());

        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_SENT)
            ->assertJsonPath('data.paid_total', '400.00')
            ->assertJsonPath('data.balance_due', '600.00');

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 600, 'method' => 'cash', 'paid_on' => now()->subDay()->toDateString(),
            'note' => 'Paid at the office',
        ])->assertCreated();

        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.stored_status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.paid_total', '1000.00')
            ->assertJsonPath('data.balance_due', '0.00')
            ->assertJson(fn ($json) => $json->whereType('data.paid_at', 'string')->etc());

        // The payments list shows both records, newest payment date first.
        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}/payments")
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_payment_only_on_sent_invoices(): void
    {
        $owner = $this->makeUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        foreach ([Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED, Invoice::STATUS_PAID] as $status) {
            $invoice = Invoice::factory()->create([
                'agency_id' => $owner->agency_id,
                'client_id' => $client->id,
                'status' => $status,
                'total' => 100,
            ]);
            $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
                'amount' => 10, 'method' => 'cash',
            ])
                ->assertStatus(422)
                ->assertJsonPath('error.code', 'PAYMENT_NOT_ALLOWED');
        }
    }

    public function test_overpayment_is_rejected(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeSentInvoice($owner);

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 1000.01, 'method' => 'cash',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'OVERPAYMENT_NOT_ALLOWED');

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 400, 'method' => 'cash',
        ])->assertCreated();

        // After a partial payment the ceiling is the remaining balance.
        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 600.01, 'method' => 'cash',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'OVERPAYMENT_NOT_ALLOWED');
    }

    public function test_payment_validation(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeSentInvoice($owner);

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 0, 'method' => 'cash',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['details' => ['amount']]]);

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 10, 'method' => 'card',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['details' => ['method']]]);
    }

    public function test_deleting_a_payment_recomputes_balance_and_status(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeSentInvoice($owner);

        $payment = $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 1000, 'method' => 'bank_transfer',
        ])->assertCreated()->json('data');

        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertJsonPath('data.status', Invoice::STATUS_PAID);

        $this->as($owner)->deleteJson("/api/v1/payments/{$payment['id']}")->assertNoContent();

        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_SENT)
            ->assertJsonPath('data.paid_at', null)
            ->assertJsonPath('data.paid_total', '0.00')
            ->assertJsonPath('data.balance_due', '1000.00');

        $this->assertSoftDeleted('payments', ['id' => $payment['id']]);
    }

    public function test_cancel_with_payments_is_rejected(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeSentInvoice($owner);

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 100, 'method' => 'cash',
        ])->assertCreated();

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CANNOT_CANCEL_INVOICE');
    }

    public function test_payment_permissions(): void
    {
        $owner = $this->makeUser();
        $agencyId = $owner->agency_id;
        $sales = $this->makeUser([Role::SALES_MANAGER], $agencyId);
        $accountant = $this->makeUser([Role::ACCOUNTANT], $agencyId);
        $invoice = $this->makeSentInvoice($owner);

        $this->as($sales)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 10, 'method' => 'cash',
        ])->assertForbidden();

        $payment = $this->as($accountant)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 10, 'method' => 'cash',
        ])->assertCreated()->json('data');

        // Deleting is the same payments.manage permission.
        $this->as($sales)->deleteJson("/api/v1/payments/{$payment['id']}")->assertForbidden();
        $this->as($accountant)->deleteJson("/api/v1/payments/{$payment['id']}")->assertNoContent();
    }

    public function test_payment_of_another_agency_returns_404(): void
    {
        $owner = $this->makeUser();
        $foreignOwner = $this->makeUser();
        $foreignInvoice = $this->makeSentInvoice($foreignOwner);
        $foreignPayment = Payment::factory()->create([
            'agency_id' => $foreignOwner->agency_id,
            'invoice_id' => $foreignInvoice->id,
            'recorded_by' => $foreignOwner->id,
        ]);

        $this->as($owner)->deleteJson("/api/v1/payments/{$foreignPayment->id}")->assertNotFound();
        $this->assertNotSoftDeleted('payments', ['id' => $foreignPayment->id]);
    }

    public function test_overdue_clears_once_fully_paid(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeSentInvoice($owner, ['due_date' => now()->subDays(3)->toDateString()]);

        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertJsonPath('data.status', Invoice::STATUS_OVERDUE);

        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 1000, 'method' => 'bank_transfer',
        ])->assertCreated();

        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertJsonPath('data.status', Invoice::STATUS_PAID);
    }
}
