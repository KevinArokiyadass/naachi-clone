import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';

export type AdminUserDocument = AdminUser & Document;

export interface IMetaTag {
  institutionId: string;
  departmentsId: string[];
}

@Schema({ timestamps: true })
export class AdminUser extends Document {
  @Prop({ required: true, unique: true, default: () => nanoid() })
  adminId: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  userName: string;

  @Prop({})
  phoneNumber: string;

  @Prop({ type: String })
  password: string;

  @Prop({ type: String })
  role: string;

  @Prop({ type: Boolean })
  isDeleted: boolean;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({
    type: [Object],
    default: [],
    required: false
  })
  metaTags?: IMetaTag[];
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);