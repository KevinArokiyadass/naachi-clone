import { IsNotEmpty, IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {

    @IsNotEmpty()
    @IsString()
    phoneNumber:string;

    @IsNotEmpty()
    @IsString()
    email:string;

    @IsNotEmpty()
    @IsString()
    password:string;

    @IsNotEmpty()
    @IsString()
    @Matches(/^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/, {
        message: 'Username must be 1-30 characters long, contain only letters, numbers, dots, and underscores. Cannot start or end with a dot, and cannot have consecutive dots.'
    })
    userName:string;

    @IsNotEmpty()
    @IsString()
    Name:string;
}