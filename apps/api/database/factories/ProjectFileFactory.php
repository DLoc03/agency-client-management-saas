<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ProjectFile> */
class ProjectFileFactory extends Factory
{
    protected $model = ProjectFile::class;

    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Project::find($attrs['project_id'])?->agency_id,
            'project_id' => Project::factory(),
            'uploaded_by' => User::factory(),
            'uploader_kind' => ProjectFile::UPLOADER_STAFF,
            'original_name' => fake()->word().'.pdf',
            'stored_path' => 'agency-1/project-1/'.fake()->uuid().'.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => fake()->numberBetween(1024, 1048576),
            'client_visible' => true,
        ];
    }
}
