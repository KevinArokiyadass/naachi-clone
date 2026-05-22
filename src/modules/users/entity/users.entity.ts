import { UserStatus, userStatus, USER_STATUS } from "src/common/enums/user.enum";
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

    @Prop({ type: String, required: false, select: false })
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
    isVerified: boolean;

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean;

    @Prop({ type: String })
    deviceId?: string;

    @Prop({ type: String })
    otp?: string;

    @Prop({ type: Date })
    otpExpiry?: Date;

    @Prop({ type: Date })
    lastLoginAt?: Date;

    @Prop({
        type: String,
        enum: userStatus,
        default: USER_STATUS.PENDING
    })
    status: UserStatus;

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

    @Prop({ type: String })
    departmentsId?: string;

    @Prop({ type: String, required: false, trim: true })
    referrerId?: string;

    @Prop({ type: String, required: false })
    referredBy?: string;

    @Prop({
        type: String,
        enum: ['qrCode', 'institutionMail', 'mutualFriend', 'referralCode'],
        required: false,
        trim: true,
    })
    referrerMedium?: string;

    @Prop({ type: Boolean, default: false })
    qrAuth?: boolean;

    @Prop({ type: Boolean, default: false })
    isReferralVerified: boolean;

    @Prop({ type: String, required: false, trim: true })
    profileImage?: string;

    @Prop({ type: Date, required: false })
    profileImageUpdatedAt?: Date;

    @Prop({ type: Boolean, default: false })
    customLogin: boolean;

    @Prop({ type: Boolean, default: false })
    isBlocked: boolean;

    @Prop({ type: Boolean, default: false })
    showPhoneNumber: boolean;

    @Prop({ type: Boolean, default: false })
    muteNotifications: boolean;

    @Prop({ type: Boolean, default: false })
    disableReadReceipt: boolean;

    @Prop({
        type: {
            institutionId: { type: String, required: false }
        },
        required: false,
        default: {}
    })
    metaData?: {
        institutionId?: string;
    };

    @Prop({
        type: String,
        required: false,
        unique: true,
        sparse: true,
        trim: true,
    })
    referralCode?: string;
}

export const UsersSchema = SchemaFactory.createForClass(Users);

// Auto-delete expired incomplete signup documents
UsersSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });