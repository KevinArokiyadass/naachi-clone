import { Injectable } from '@nestjs/common';
import {S3Client,PutObjectCommand,GetObjectCommand,} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {CognitoIdentityProviderClient} from '@aws-sdk/client-cognito-identity-provider';

@Injectable()
export class AwsStoreService {
  private s3Client: S3Client;
  private readonly bucketName: string = process.env.AWS_S3_BUCKET_NAME;
  private readonly cloudFrontUrl: string = process.env.CLOUD_FRONT_URL;
  public cognitoClient: CognitoIdentityProviderClient;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async generatePresignedUrl(
    fileName: string,
    contentType: string,
  ): Promise<{ signedUrl: string; s3FileName: string }> {
    const s3FileName = `${uuidv4()}_${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3FileName,
      ContentType: contentType,
    });
    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
    return { signedUrl, s3FileName };
  }

  getCloudFrontUrl(s3FileName: string): string {
    console.log('s3FileName', s3FileName)
    // Ensure there's a single slash between CloudFront URL and filename
    const baseUrl = this.cloudFrontUrl.endsWith('/') 
      ? this.cloudFrontUrl 
      : `${this.cloudFrontUrl}/`;
    return `${baseUrl}${s3FileName}`;
  }

  async getFileUrl(s3FileName: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3FileName,
    });
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return url;
  }
}