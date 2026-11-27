<?php

namespace App\Http\Requests\Portal;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * File upload to a project (docs/PORTAL_CONTRACT.md sections 2.2/3,
 * DEC-028 Q4). The size cap and the extension allowlist come from
 * config/portal.php so they can be tuned via the environment. The
 * extension is checked against the real uploaded file, never against
 * client-supplied metadata. Shared by the staff and Portal routes.
 */
class UploadProjectFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.config('portal.files.max_size_kb')],
            // Only the staff side may set this; the Portal controller
            // ignores it (client uploads are always agency-visible).
            'client_visible' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $file = $this->file('file');
            if (! $file) {
                return;
            }

            // extension() guesses from the file's real MIME type
            // (content inspection), never from the client name.
            $extension = $file->extension();
            if ($extension === null || ! in_array($extension, config('portal.files.extensions', []), true)) {
                $validator->errors()->add('file', 'This file type is not allowed.');
            }
        });
    }
}
