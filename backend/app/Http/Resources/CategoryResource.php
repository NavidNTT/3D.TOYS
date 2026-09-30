<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Storefront representation of a category.
 *
 * `theme_config` is passed through untouched: it is a free-form palette
 * (primary/glow/accent/background) owned by the admin, and the frontend
 * normalises missing keys itself (see src/lib/theme.ts).
 *
 * @mixin Category
 */
class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'theme_config' => $this->theme_config,
        ];
    }
}
