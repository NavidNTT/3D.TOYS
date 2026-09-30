<?php

namespace App\Filament\Resources;

use App\Enums\OrderStatus;
use App\Filament\Resources\OrderResource\Pages;
use App\Models\Order;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';

    protected static ?string $navigationLabel = 'مدیریت سفارش‌ها';

    protected static ?int $navigationSort = 2;

    /**
     * Orders are placed through checkout, never created by hand in the panel.
     */
    public static function canCreate(): bool
    {
        return false;
    }

    /**
     * Status values mapped to their Persian labels.
     *
     * @return array<string, string>
     */
    protected static function statusOptions(): array
    {
        return collect(OrderStatus::cases())
            ->mapWithKeys(fn (OrderStatus $status): array => [$status->value => $status->label()])
            ->all();
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('وضعیت و مشخصات مالی')
                    ->schema([
                        TextInput::make('order_number')
                            ->label('شماره سفارش')
                            ->disabled(),
                        Select::make('status')
                            ->label('وضعیت سفارش')
                            ->options(self::statusOptions())
                            ->formatStateUsing(fn ($state): ?string => $state instanceof OrderStatus ? $state->value : $state)
                            ->required(),
                        TextInput::make('total_amount')
                            ->label('مبلغ کل')
                            ->numeric()
                            ->disabled()
                            ->suffix('تومان'),
                        DateTimePicker::make('created_at')
                            ->label('تاریخ ثبت')
                            ->disabled(),
                    ])
                    ->columns(2),

                Section::make('مشخصات خریدار و آدرس')
                    ->schema([
                        TextInput::make('receiver_name')
                            ->label('نام گیرنده'),
                        TextInput::make('receiver_phone')
                            ->label('شماره تماس گیرنده'),
                        TextInput::make('province')
                            ->label('استان'),
                        TextInput::make('city')
                            ->label('شهر'),
                        TextInput::make('postal_code')
                            ->label('کد پستی'),
                        Textarea::make('address')
                            ->label('آدرس')
                            ->rows(3)
                            ->columnSpanFull(),
                        Textarea::make('notes')
                            ->label('یادداشت')
                            ->rows(2)
                            ->disabled()
                            ->columnSpanFull(),
                    ])
                    ->columns(2),

                Section::make('لیست اقلام سفارش')
                    ->schema([
                        Repeater::make('items')
                            ->relationship('items')
                            ->label('اقلام سفارش')
                            ->schema([
                                TextInput::make('product_title')
                                    ->label('نام محصول')
                                    ->disabled(),
                                TextInput::make('quantity')
                                    ->label('تعداد')
                                    ->numeric()
                                    ->disabled(),
                                TextInput::make('unit_price')
                                    ->label('قیمت واحد')
                                    ->numeric()
                                    ->disabled()
                                    ->suffix('تومان'),
                                TextInput::make('total_price')
                                    ->label('قیمت کل')
                                    ->numeric()
                                    ->disabled()
                                    ->suffix('تومان'),
                            ])
                            ->columns(4)
                            ->addable(false)
                            ->deletable(false),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('order_number')
                    ->label('شماره سفارش')
                    ->searchable()
                    ->sortable()
                    ->copyable()
                    ->weight('bold'),
                TextColumn::make('receiver_name')
                    ->label('نام گیرنده'),
                TextColumn::make('receiver_phone')
                    ->label('شماره تماس'),
                TextColumn::make('city')
                    ->label('شهر'),
                TextColumn::make('total_amount')
                    ->label('مبلغ کل')
                    ->numeric(decimalPlaces: 0, decimalSeparator: '.', thousandsSeparator: ',')
                    ->suffix(' تومان')
                    ->sortable(),
                BadgeColumn::make('status')
                    ->label('وضعیت')
                    ->formatStateUsing(fn ($state): string => $state instanceof OrderStatus ? $state->label() : (string) $state)
                    ->color(fn ($state): string => match ($state instanceof OrderStatus ? $state : OrderStatus::tryFrom((string) $state)) {
                        OrderStatus::Pending => 'warning',
                        OrderStatus::Paid => 'success',
                        OrderStatus::Processing => 'info',
                        OrderStatus::Completed => 'primary',
                        OrderStatus::Cancelled => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('created_at')
                    ->label('تاریخ ثبت')
                    ->dateTime()
                    ->sortable(),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('status')
                    ->label('وضعیت')
                    ->options(self::statusOptions()),
            ])
            ->actions([
                Tables\Actions\EditAction::make()
                    ->label('مشاهده و ویرایش'),
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
            'index' => Pages\ListOrders::route('/'),
            'edit' => Pages\EditOrder::route('/{record}/edit'),
        ];
    }
}
