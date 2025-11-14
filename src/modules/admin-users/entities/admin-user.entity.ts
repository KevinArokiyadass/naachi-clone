import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';

export type AdminUserDocument = AdminUser & Document;

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

  @Prop({  })
  phoneNumber: string;

  @Prop({ type: String })
  password: string;
  
  @Prop({ type: String })
  role: string;

  @Prop({ type: Boolean })
  isDeleted: Boolean
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);