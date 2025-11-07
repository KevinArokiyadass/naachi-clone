import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { generateUniqueId, comparePassword } from '../../../common/utils/util';
import { IUser, UserType } from '../../../common/interfaces/user.interface';

export type UserDocument = User & Document;

@Schema({ timestamps: true, versionKey: false })
export class User extends Document implements IUser {
    @Prop({ type: String, default: () => generateUniqueId(), trim: true })
    userId: string;

    @Prop({ type: String, unique: true, sparse: true })
    phoneNumber?: string;

    @Prop({ type: String, required: true, trim: true })
    firstName: string;

    @Prop({ type: String, trim: true })
    emailId?: string;

    @Prop({ type: String, required: function () { return this.userType === UserType.ADMIN; } })
    password?: string;

    @Prop({ type: String, trim: true })
    employeeId?: string;

    @Prop({ type: String, trim: true })
    lastName?: string;

    @Prop({ type: String, trim: true })
    address?: string;

    @Prop({ type: String, trim: true })
    locationId?: string;

    @Prop({ type: String, trim: true })
    divisionId?: string;

    @Prop({ type: String, enum: UserType, required: true, default: UserType.MEMBER })
    userType: UserType;

    @Prop({ type: String })
    profilePictureOriginalFileName?: string;

    @Prop({ type: String })
    profilePictureS3FileName?: string;

    @Prop({ type: String })
    profileImageUrl?: string;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    @Prop({ type: Date })
    lastLoginAt?: Date;

    @Prop({ type: [String], default: [] })
    permissionGroup: string[];

    @Prop({
        type: [{
            type: { type: String, required: true },
            token: { type: String, required: true }
        }],
        default: []
    })
    fcmTokens?: Array<{ type: string; token: string }>;
    @Prop({ type: String })
    otp: any;
    @Prop({ type: Date })
    otpExpiry: any;
    // Method to compare password
    async comparePassword(candidatePassword: string): Promise<boolean> {
        if (!this.password) {
            return false;
        }
        return comparePassword(candidatePassword, this.password);
    }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add instance methods to the schema
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    if (!this.password) {
        return false;
    }
    return comparePassword(candidatePassword, this.password);
};

