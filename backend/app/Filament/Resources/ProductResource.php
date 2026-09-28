<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductResource\Pages;
use App\Models\Product;
use Filament\Forms;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Form;
use Filament\Forms\Set;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class ProductResource extends Resource
{
    protected static ?string $model = Product::class;

    protected static ?string $navigationIcon = 'heroicon-o-cube';

    protected static ?string $navigationGroup = 'Shop';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('General Information')
                    ->schema([
                        TextInput::make('title')
                            ->label('Title')
                            ->required()
                            ->maxLength(255)
                            ->live(onBlur: true)
                            ->afterStateUpdated(function (Set $set, ?string $state) {
                                $set('slug', Str::slug($state ?? ''));
                                $set('name', $state);
                            }),
                        TextInput::make('slug')
                            ->required()
                            ->maxLength(255)
                            ->unique(Product::class, 'slug', ignoreRecord: true),
                        TextInput::make('sku')
                            ->label('SKU')
                            ->maxLength(100)
                            ->unique(Product::class, 'sku', ignoreRecord: true),
                        Select::make('category_id')
                            ->relationship('category', 'name')
                            ->searchable()
                            ->preload()
                            ->nullable(),
                        TextInput::make('price')
                            ->required()
                            ->numeric()
                            ->prefix('$')
                            ->minValue(0),
                        TextInput::make('stock')
                            ->required()
                            ->numeric()
                            ->integer()
                            ->default(0)
                            ->minValue(0),
                        Select::make('status')
                            ->options([
                                'active' => 'Active',
                                'draft' => 'Draft',
                                'archived' => 'Archived',
                            ])
                            ->default('draft')
                            ->required(),
                        Textarea::make('description')
                            ->rows(4)
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('Attributes')
                    ->description('Dynamic key-value pairs defining toy specifications (e.g. Material, Age, Scale).')
                    ->schema([
                        KeyValue::make('attributes')
                            ->label('Toy Attributes')
                            ->keyLabel('Specification')
                            ->valueLabel('Value')
                            ->reorderable(),
                    ]),

                Section::make('3D Model & Interactive Viewer')
                    ->relationship('media3d')
                    ->description('Upload 3D assets (.glb / .gltf) and configure lighting and camera settings for the 3D viewer.')
                    ->schema([
                        FileUpload::make('original_file_url')
                            ->label('3D Model File (.glb, .gltf)')
                            ->disk('public')
                            ->directory('models/3d')
                            ->acceptedFileTypes(['model/gltf-binary', 'model/gltf+json', '.glb', '.gltf'])
                            ->maxSize(65536)
                            ->downloadable()
                            ->columnSpanFull(),
                        FileUpload::make('thumbnail_url')
                            ->label('3D Model Thumbnail')
                            ->image()
                            ->disk('public')
                            ->directory('models/thumbnails')
                            ->columnSpanFull(),
                        Select::make('lighting_preset')
                            ->label('Lighting Preset')
                            ->options([
                                'studio' => 'Studio',
                                'sunset' => 'Sunset',
                                'night' => 'Night',
                                'city' => 'City',
                            ])
                            ->default('studio')
                            ->required(),
                        TextInput::make('camera_settings.initial_fov')
                            ->label('Initial FOV (Field of View)')
                            ->numeric()
                            ->default(45)
                            ->minValue(10)
                            ->maxValue(120),
                        Toggle::make('auto_rotate')
                            ->label('Auto Rotate')
                            ->default(true),
                        TextInput::make('rotation_speed')
                            ->label('Rotation Speed')
                            ->numeric()
                            ->default(1.0)
                            ->step(0.1),
                    ])
                    ->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')
                    ->label('Title')
                    ->searchable()
                    ->sortable()
                    ->default(fn (Product $record) => $record->name),
                TextColumn::make('sku')
                    ->label('SKU')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('category.name')
                    ->label('Category')
                    ->sortable(),
                TextColumn::make('price')
                    ->money('USD')
                    ->sortable(),
                TextColumn::make('stock')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'draft' => 'warning',
                        'archived' => 'danger',
                        default => 'gray',
                    }),
                IconColumn::make('media3d.original_file_url')
                    ->label('3D Asset')
                    ->boolean()
                    ->trueIcon('heroicon-o-cube-transparent')
                    ->falseIcon('heroicon-o-x-mark'),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('category')
                    ->relationship('category', 'name'),
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Active',
                        'draft' => 'Draft',
                        'archived' => 'Archived',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListProducts::route('/'),
            'create' => Pages\CreateProduct::route('/create'),
            'edit' => Pages\EditProduct::route('/{record}/edit'),
        ];
    }
}