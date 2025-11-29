import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { generateUniqueId } from 'src/common/utils/util';
import { IMetaTag } from 'src/common/enums/user.enum';
 

export type AdminUserDocument = AdminUser & Document;
 
@Schema({ timestamps: true })
export class AdminUser extends Document {
  @Prop({ required: true, unique: true, default: () => generateUniqueId() })
  adminId: string;
 
  @Prop({ required: true })
  name: string;
 
  @Prop({ required: true, unique: true })
  email: string;
 
  @Prop({ unique: true, sparse: true, required:false })
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

  @Prop({ type: [String], required: true })
  permissionGroupsId: string[];
 
  @Prop({
    type: [{
      institutionsId: { type: String },
      departmentsId: { type: [String], default: [] }
    }],
    default: null,
    required: false
  })
  metaTags?: IMetaTag[];
}
 
export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);