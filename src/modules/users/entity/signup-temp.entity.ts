import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type SignupTempDocument = SignupTemp & Document;

@Schema({ timestamps: true, versionKey: false })
export class SignupTemp extends Document {
    @Prop({ type: String, required: true, unique: true, index: true })
    phoneNumber: string;

    @Prop({ type: Boolean, default: false })
    phoneVerified: boolean;

    @Prop({ type: String })
    phoneOtp?: string;

    @Prop({ type: Date })
    phoneOtpExpiry?: Date;

    @Prop({ type: String })
    userName?: string;

    @Prop({ type: Boolean, default: false })
    userNameSet: boolean;

    @Prop({ type: String })
    email?: string;

    @Prop({ type: Boolean, default: false })
    emailVerified: boolean;

    @Prop({ type: String })
    emailOtp?: string;

    @Prop({ type: Date })
    emailOtpExpiry?: Date;

    @Prop({ type: String })
    Name?: string;

    @Prop({ type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000) })
    expiresAt: Date;

    @Prop({ type: Boolean, default: false })
    completed: boolean;

    @Prop({ type: Date })
    completedAt?: Date;
}

export const SignupTempSchema = SchemaFactory.createForClass(SignupTemp);

// Auto-delete expired documents
SignupTempSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
