import { IsEmail, IsString, MinLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  email!: string;
}

export class NewsletterTokenDto {
  @IsString()
  @MinLength(16)
  token!: string;
}
