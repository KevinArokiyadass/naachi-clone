import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { generateUniqueId } from 'src/common/utils/util';
 
export type AdminUserDocument = AdminUser & Document;
 
export interface IMetaTag {
  institutionId: string;
  departmentsId: string[];
}
 
@Schema({ timestamps: true })
export class AdminUser extends Document {
  @Prop({ required: true, unique: true, default: () => generateUniqueId() })
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
  isDeleted: boolean;
 
  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: string;
 
  @Prop({
    type: [{
      institutionId: { type: String },
      departmentsId: { type: [String], default: [] }
    }],
    default: null,
    required: false
  })
  metaTags?: IMetaTag[];
}
 
export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);