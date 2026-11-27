<?php

namespace Database\Factories;

use App\Models\PortalComment;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PortalComment> */
class PortalCommentFactory extends Factory
{
    protected $model = PortalComment::class;

    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Project::find($attrs['project_id'])?->agency_id,
            'project_id' => Project::factory(),
            'author_id' => User::factory(),
            'author_kind' => PortalComment::AUTHOR_CLIENT,
            'body' => fake()->sentence(),
        ];
    }
}
