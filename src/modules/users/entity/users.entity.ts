import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { generateUniqueId } from "src/common/utils/util";

export type UsersDocument = Users & Document;

@Schema({ timestamps: true, versionKey: false })
export class Users extends Document {
    @Prop({ type: String, default: () => generateUniqueId(), unique: true, trim: true })
    userId: string;

    @Prop({ type: String, required: true, trim: true })
    phoneNumber: string;

    @Prop({ type: String, required: false, trim: true, sparse: true })
    email?: string;

    @Prop({ type: String, required: false })
    password?: string;

    @Prop({ 
        type: String, 
        required: false, 
        trim: true,
        unique: true,
        sparse: true,
        match: /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/
    })
    userName?: string;

    @Prop({ type: String, trim: true })
    name?: string;

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

    @Prop({ 
        type: String, 
        enum: ['pending', 'completed'], 
        default: 'pending' 
    })
    status: string;

    @Prop({ type: Boolean, default: false })
    phoneVerified: boolean;

    @Prop({ type: String })
    phoneOtp?: string;

    @Prop({ type: Date })
    phoneOtpExpiry?: Date;

    @Prop({ type: Boolean, default: false })
    userNameSet: boolean;

    @Prop({ type: Boolean, default: false })
    emailVerified: boolean;

    @Prop({ type: String })
    emailOtp?: string;

    @Prop({ type: Date })
    emailOtpExpiry?: Date;

    @Prop({ type: Date })
    expiresAt?: Date;

    @Prop({ type: String })
    institutionsId?: string;

    @Prop({ type: String, required: false, trim: true })
    referrerId?: string;
    
    @Prop({ type: String, required: false })
    referredBy?: string;

    @Prop({
        type: String,
        enum: ['qrCode', 'institutionMail', 'mutualFriend'],
        required: false,
        trim: true,
    })
    referrerMedium?: string;

    @Prop({ type: Boolean, default: false })
    qrAuth?: boolean;


    @Prop({ type: String, required: false, trim: true })
    profileImage?: string;

    @Prop({ type: Date, required: false })
    profileImageUpdatedAt?: Date;
}

export const UsersSchema = SchemaFactory.createForClass(Users);

// Auto-delete expired incomplete signup documents
UsersSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });