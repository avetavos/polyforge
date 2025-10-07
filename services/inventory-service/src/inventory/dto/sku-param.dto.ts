import { IsNotEmpty, IsString, IsUppercase } from 'class-validator';

export class SkuParamDto {
  @IsString()
  @IsUppercase()
  @IsNotEmpty()
  sku: string;
}
