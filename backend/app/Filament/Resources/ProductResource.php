<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductResource\Pages;
use App\Models\Product;
use App\Models\ProductMedia3D;
use App\Rules\IrtAmount;
use App\Support\MediaStorage;
use App\Support\Currency;
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
use Illuminate\Support\Facades\Storage;
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
                            ->label('Price (Toman)')
                            ->required()
                            ->numeric()
                            ->integer()
                            ->rule(new IrtAmount)
                            ->suffix('تومان')
                            ->minValue(0)
                            ->helperText('مبلغ باید عدد صحیح و نامنفی به تومان باشد. قیمتهای قدیمی دلاری باید پیش از فروش به تومان نهایی شوند.'),
                        // Only toman is sellable, so only toman is offered. This is
                        // the guard that stops a new USD row being created: the
                        // form cannot express "charge in dollars".
                        Select::make('currency')
                            ->label('Currency')
                            ->options([Currency::IRT => 'IRT — تومان'])
                            ->default(Currency::IRT)
                            ->required()
                            ->selectablePlaceholder(false)
                            ->helperText('فقط تومان قابل فروش است. مبالغ قدیمی حفظ شده و در «قیمت قدیمی» نمایش داده میشوند.'),
                        // The preserved, pre-migration amount, shown verbatim while
                        // a legacy row waits for an approved USD→IRT mapping. This
                        // is the "display the legacy currency correctly" half of
                        // the safety rule: nothing here is converted automatically.
                        Forms\Components\Placeholder::make('legacy_price_notice')
                            ->label('قیمت قدیمی (حفظ‌شده)')
                            ->visible(fn (?Product $record): bool => $record !== null
                                && ! $record->purchasable()
                                && $record->legacyAmount() !== null)
                            ->content(fn (?Product $record): string => sprintf(
                                '%s %s — این مقدار حفظ شده و به تومان تبدیل نشده است؛ پیش از فروش باید دستی تأیید و به تومان نهایی شود.',
                                $record?->legacyAmount() ?? '—',
                                Currency::label($record?->legacyCurrency()),
                            ))
                            ->columnSpanFull(),
                        TextInput::make('stock')
                            ->required()
                            ->numeric()
                            ->integer()
                            ->default(0)
                            ->minValue(0),
                        // The three-state `status` select was retired: `is_active`
                        // is the single source of truth, because it is the column
                        // the storefront listing and checkout already enforce.
                        Toggle::make('is_active')
                            ->label('Published')
                            ->helperText('Unpublished products are hidden from the storefront and cannot be ordered.')
                            ->default(true),
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
                            ->disk(MediaStorage::ingestDisk())
                            ->directory('models/3d')
                            ->acceptedFileTypes(['model/gltf-binary', 'model/gltf+json', '.glb', '.gltf'])
                            ->maxSize(65536)
                            ->downloadable()
                            ->columnSpanFull(),
                        // Inside a `->relationship('media3d')` section, Filament
                        // resolves `$record` to the *related* model, not the
                        // product. Typing this closure as `?Product` therefore
                        // threw a TypeError and made the product edit page
                        // answer 500 — which also hid the legacy-price notice
                        // added below. Read the media row directly.
                        Forms\Components\Placeholder::make('draco_status')
                            ->label('وضعیت بهینه‌سازی (Draco)')
                            ->content(function (?ProductMedia3D $record): string {
                                if (! $record || empty($record->original_file_url)) {
                                    return '—';
                                }

                                if (empty($record->optimized_file_url)) {
                                    return 'در حال بهینه‌سازی';
                                }

                                $savings = '';
                                $optimized = (int) ($record->file_size ?? 0);

                                // Measured through the disk, not `public_path()`:
                                // uploads now land in object storage, where a
                                // filesystem path does not exist at all. A missing
                                // object simply reports no saving — the number is
                                // never guessed.
                                $originalKey = ltrim((string) $record->original_file_url, '/');
                                // A remote fixture (the seeded Khronos Duck URL) is
                                // not ours to measure, so it reports no saving
                                // rather than a request to a third party.
                                $original = 0;

                                if (! str_contains($originalKey, '://')) {
                                    try {
                                        $disk = Storage::disk(MediaStorage::ingestDisk());
                                        $original = $disk->exists($originalKey)
                                            ? (int) $disk->size($originalKey)
                                            : 0;
                                    } catch (\Throwable) {
                                        // A savings percentage is not worth a 500 on
                                        // the edit form. The upload fields below hit
                                        // the same disk and still surface a real
                                        // outage, so a blip here only omits the
                                        // figure instead of hiding the problem.
                                        $original = 0;
                                    }
                                }

                                if ($optimized > 0 && $original > 0 && $optimized < $original) {
                                    $pct = round((($original - $optimized) / $original) * 100, 1);
                                    $savings = ' — صرفه‌جویی: '.$pct.'٪';
                                }

                                return 'بهینه‌شده (Draco)'.$savings;
                            })
                            ->columnSpanFull(),
                        FileUpload::make('thumbnail_url')
                            ->label('3D Model Thumbnail')
                            ->image()
                            ->disk(MediaStorage::ingestDisk())
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
                    ->sortable(),
                TextColumn::make('sku')
                    ->label('SKU')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('category.name')
                    ->label('Category')
                    ->sortable(),
                TextColumn::make('price')
                    ->label('Price')
                    ->numeric(decimalPlaces: 0, decimalSeparator: '.', thousandsSeparator: ',')
                    ->suffix(' تومان')
                    ->placeholder('نامشخص — قیمت قدیمی')
                    ->sortable(),
                // At-a-glance answer to "which rows are still not toman?".
                TextColumn::make('currency')
                    ->label('Currency')
                    ->badge()
                    ->color(fn (?Product $record): string => Currency::isSellable($record?->currency) ? 'success' : 'warning')
                    ->sortable(),
                TextColumn::make('stock')
                    ->numeric()
                    ->sortable(),
                IconColumn::make('is_active')
                    ->label('Published')
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-x-circle')
                    ->trueColor('success')
                    ->falseColor('gray'),
                IconColumn::make('media3d.original_file_url')
                    ->label('3D Asset')
                    ->boolean()
                    ->trueIcon('heroicon-o-cube-transparent')
                    ->falseIcon('heroicon-o-x-mark'),
                TextColumn::make('media3d.optimized_file_url')
                    ->label('Draco')
                    ->badge()
                    ->getStateUsing(fn (?Product $record): string => (! $record?->media3d || empty($record->media3d->original_file_url))
                        ? '—'
                        : (empty($record->media3d->optimized_file_url) ? 'در حال بهینه‌سازی' : 'بهینه‌شده (Draco)'))
                    ->color(fn (?Product $record): string => (! $record?->media3d || empty($record->media3d->original_file_url))
                        ? 'gray'
                        : (empty($record->media3d->optimized_file_url) ? 'warning' : 'success')),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('category')
                    ->relationship('category', 'name'),
                SelectFilter::make('is_active')
                    ->label('Published')
                    ->options([
                        '1' => 'Published',
                        '0' => 'Draft',
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