import {ApiProperty} from '@nestjs/swagger'
import {IsOptional, IsString} from 'class-validator'

export class LogoutDto{
    @ApiProperty({description: 'User Id', required: false})
    @IsOptional()
    @IsString()
    userId?: string;


   @ApiProperty({ description: 'Token type ( web, ios, android)', required: false })
   @IsString()
   type?: string;

}