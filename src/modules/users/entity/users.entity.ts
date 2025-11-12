import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { generateUniqueId } from "src/common/utils/util";

export type UsersDocument = Users & Document;

@Schema({ timestamps: true, versionKey: false })
export class Users extends Document {
    @Prop({ type: String, default: () => generateUniqueId(), trim: true })
    userId: string;

    @Prop({ type: String, required: true, trim: true })
    phoneNumber: string;

    @Prop({ type: String, required: true, trim: true, unique: true })
    email: string;

    @Prop({ type: String, required: false })
    password?: string;

    @Prop({ 
        type: String, 
        required: true, 
        trim: true,
        unique: true,
        match: /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/
    })
    userName: string;

    @Prop({ type: String, trim: true })
    Name?: string;

    @Prop({ type: Boolean, default: false })
    isActive: boolean;

    @Prop({ type: Boolean, default: false })
    isVerified: boolean;

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean;

    @Prop({ type: String })
    otp?: string;

    @Prop({ type: Date })
    otpExpiry?: Date;

    @Prop({ type: Date })
    lastLoginAt?: Date;
}

export const UsersSchema = SchemaFactory.createForClass(Users);