import { IsInt, IsNotEmpty, IsString, IsUppercase, Min } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @IsUppercase()
  @IsNotEmpty()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
