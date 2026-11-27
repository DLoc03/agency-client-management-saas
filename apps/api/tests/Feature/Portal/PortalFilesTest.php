<?php

namespace Tests\Feature\Portal;

use App\Models\Client;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * BE-011 file sharing (docs/PORTAL_CONTRACT.md sections 2.2/3,
 * DEC-028 Q3/Q4/Q10): two-way uploads on the private disk,
 * authenticated streaming downloads, config-driven size/extension
 * limits, and strict client pinning.
 */
class PortalFilesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('local');
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    private function asPortal(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user, 'portal'));
    }

    private function makeProject(User $owner, int $clientId): Project
    {
        return Project::factory()->create([
            'agency_id' => $owner->agency_id,
            'client_id' => $clientId,
            'status' => Project::STATUS_IN_PROGRESS,
        ]);
    }

    public function test_staff_upload_is_listed_and_downloadable_by_the_client(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        $response = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->createWithContent('report.pdf', 'PDF-CONTENT'),
        ])->assertCreated()
            ->assertJsonPath('data.original_name', 'report.pdf')
            ->assertJsonPath('data.uploader_kind', 'staff')
            ->assertJsonMissingPath('data.stored_path');
        $fileId = $response->json('data.id');

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);
        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$project->id}/files")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $fileId);

        $download = $this->asPortal($portal)->get("/api/v1/portal/projects/{$project->id}/files/{$fileId}/download");
        $download->assertOk();
        $this->assertSame('PDF-CONTENT', $download->streamedContent());
    }

    public function test_hidden_staff_file_is_invisible_to_the_client(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        $fileId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->createWithContent('internal.pdf', 'SECRET'),
            'client_visible' => false,
        ])->assertCreated()->json('data.id');

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);
        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$project->id}/files")
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->asPortal($portal)->get("/api/v1/portal/projects/{$project->id}/files/{$fileId}/download")
            ->assertNotFound();

        // Staff still see and can download it, and can flip the flag.
        $this->as($owner)->getJson("/api/v1/projects/{$project->id}/files")
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->as($owner)->patchJson("/api/v1/projects/{$project->id}/files/{$fileId}", ['client_visible' => true])
            ->assertOk()
            ->assertJsonPath('data.client_visible', true);
        $this->asPortal($portal)->get("/api/v1/portal/projects/{$project->id}/files/{$fileId}/download")
            ->assertOk();
    }

    public function test_client_upload_is_visible_and_downloadable_by_staff(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);
        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);

        $fileId = $this->asPortal($portal)->postJson("/api/v1/portal/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->createWithContent('brief.docx', 'CLIENT-BRIEF'),
        ])->assertCreated()
            ->assertJsonPath('data.uploader_kind', 'client')
            ->json('data.id');

        $this->as($owner)->getJson("/api/v1/projects/{$project->id}/files")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $download = $this->as($owner)->get("/api/v1/projects/{$project->id}/files/{$fileId}/download");
        $download->assertOk();
        $this->assertSame('CLIENT-BRIEF', $download->streamedContent());
    }

    public function test_another_client_gets_404_everywhere(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $clientA = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $clientB = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $clientA->id);

        $fileId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->createWithContent('report.pdf', 'PDF'),
        ])->assertCreated()->json('data.id');

        $stranger = $this->makePortalIdentity($owner->agency_id, $clientB->id);
        $this->asPortal($stranger)->getJson("/api/v1/portal/projects/{$project->id}/files")->assertNotFound();
        $this->asPortal($stranger)->get("/api/v1/portal/projects/{$project->id}/files/{$fileId}/download")->assertNotFound();
        $this->asPortal($stranger)->deleteJson("/api/v1/portal/projects/{$project->id}/files/{$fileId}")->assertNotFound();
        $this->asPortal($stranger)->postJson("/api/v1/portal/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->create('x.pdf', 10),
        ])->assertNotFound();
    }

    public function test_upload_limits_are_enforced_from_config(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        // Shrink the cap for the test: a 20 KB file must be refused.
        config(['portal.files.max_size_kb' => 10]);
        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->create('big.pdf', 20),
        ])->assertUnprocessable();

        // A disallowed extension is refused even within the size cap.
        config(['portal.files.max_size_kb' => 20480]);
        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->create('payload.exe', 5),
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['details' => ['file']]]);

        $this->assertDatabaseCount('project_files', 0);
    }

    public function test_upload_is_judged_by_the_real_file_not_the_client_supplied_name(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        // A real UploadedFile built from an on-disk temp file, so
        // the MIME type comes from the actual bytes (the fake
        // factory derives its reported MIME from the file name and
        // cannot exercise this). Binary content wearing a `.pdf`
        // name is refused: the content wins over the name.
        $binaryPath = tempnam(sys_get_temp_dir(), 'be011-upload-');
        file_put_contents($binaryPath, str_repeat("\x00\x01\x02\x03", 16));
        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => new UploadedFile($binaryPath, 'report.pdf', null, null, true),
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        // …and genuine PDF bytes wearing a `.exe` name are accepted
        // as the PDF they are.
        $pdfPath = tempnam(sys_get_temp_dir(), 'be011-upload-');
        file_put_contents($pdfPath, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => new UploadedFile($pdfPath, 'payload.exe', null, null, true),
        ])->assertCreated()
            ->assertJsonPath('data.original_name', 'payload.exe')
            ->assertJsonPath('data.mime_type', 'application/pdf');

        $this->assertDatabaseCount('project_files', 1);
    }

    public function test_client_deletes_only_client_uploaded_files_and_staff_delete_removes_the_physical_file(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);
        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);

        $staffFileId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->createWithContent('agency.pdf', 'AGENCY'),
        ])->assertCreated()->json('data.id');
        $clientFileId = $this->asPortal($portal)->postJson("/api/v1/portal/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->createWithContent('mine.pdf', 'MINE'),
        ])->assertCreated()->json('data.id');

        // The agency's file is out of the client's reach.
        $this->asPortal($portal)->deleteJson("/api/v1/portal/projects/{$project->id}/files/{$staffFileId}")
            ->assertNotFound();

        // Their own upload can be removed.
        $this->asPortal($portal)->deleteJson("/api/v1/portal/projects/{$project->id}/files/{$clientFileId}")
            ->assertNoContent();

        // Staff delete removes the record AND the physical file.
        $storedPath = Tenant::bypass(fn () => ProjectFile::find($staffFileId)->stored_path);
        Storage::disk('local')->assertExists($storedPath);
        $this->as($owner)->deleteJson("/api/v1/projects/{$project->id}/files/{$staffFileId}")
            ->assertNoContent();
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_staff_upload_requires_the_portal_files_permission(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        // A Team Member may view the project (as a member) and reply
        // in the thread, but holds no portal.files.manage key.
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project->members()->attach($member->id);

        $this->as($member)->postJson("/api/v1/projects/{$project->id}/files", [
            'file' => UploadedFile::fake()->create('nope.pdf', 5),
        ])->assertForbidden();
    }
}
