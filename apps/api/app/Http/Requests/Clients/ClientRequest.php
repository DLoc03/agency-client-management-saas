<?php

namespace App\Http\Requests\Clients;

use App\Exceptions\ApiException;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared payload rules for creating/updating a client, including the
 * cross-tenant reference checks of docs/CLIENT_CONTRACT.md section 3:
 * referencing another agency's user/tag is a 422 CROSS_TENANT_REFERENCE,
 * not a plain validation error.
 */
abstract class ClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    abstract protected function creating(): bool;

    public function rules(): array
    {
        $required = $this->creating() ? ['required'] : ['sometimes'];

        return [
            'name' => [...$required, 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['company', 'individual'])],
            'status' => ['sometimes', Rule::in(['active', 'paused', 'churned'])],
            'account_manager_id' => ['nullable', 'integer'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'website' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'tax_code' => ['nullable', 'string', 'max:50'],
            'tag_ids' => ['sometimes', 'array'],
            'tag_ids.*' => ['integer'],
            'organization' => ['sometimes', 'array'],
            'organization.legal_name' => ['nullable', 'string', 'max:255'],
            'organization.industry' => ['nullable', 'string', 'max:255'],
            'organization.size' => ['nullable', 'string', 'max:50'],
            'organization.address' => ['nullable', 'string', 'max:500'],
            'organization.tax_code' => ['nullable', 'string', 'max:50'],
            'organization.website' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $agencyId = $this->user()->agency_id;

            if ($this->filled('account_manager_id')) {
                $manager = User::find($this->input('account_manager_id'));
                if (! $manager) {
                    $validator->errors()->add('account_manager_id', 'User not found.');
                } elseif ($manager->agency_id !== $agencyId) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'account_manager_id']);
                }
            }

            $tagIds = $this->input('tag_ids', []);
            if (is_array($tagIds) && $tagIds !== []) {
                $tags = Tag::withoutGlobalScopes()->whereIn('id', $tagIds)->get();
                if ($tags->count() !== count(array_unique($tagIds))) {
                    $validator->errors()->add('tag_ids', 'One or more tags do not exist.');
                } elseif ($tags->contains(fn (Tag $tag) => $tag->agency_id !== $agencyId)) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'tag_ids']);
                }
            }
        });
    }

    /** Client attributes without the nested organization / tag payloads. */
    public function clientAttributes(): array
    {
        return collect($this->validated())->except(['organization', 'tag_ids'])->all();
    }
}
