import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post } from "@nestjs/common";
import { FirebaseService } from "./firebase.service";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ValidateTokenDto, ValidateTokenResponseDto } from "./dto/validate-token.dto";

@ApiTags('Firebase Notifications')
@Controller('firebase')
export class FireBaseController {
  private readonly logger = new Logger(FireBaseController.name);

  constructor(
    private readonly firebaseService: FirebaseService,
  ) { }


  /* Send notification to a single device */
  @Post('device')
  @HttpCode(HttpStatus.OK)
  async sendToDevice(
    @Body() body: { token: string; notification: any; data?: Record<string, string> }
  ): Promise<{ messageId: string }> {
    this.logger.log(`Sending notification to device: ${body.token}`);
    const messageId = await this.firebaseService.sendToDevice(
      body.token,
      body.notification,
      body.data
    );
    return { messageId };
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async sendBulk(
    @Body()
    body: {
      tokens: string[];
      notification: {
        title: string;
        body: string;
        imageUrl?: string;
        clickAction?: string;
      };
      data?: Record<string, string>;
    },
  ): Promise<{
    successCount: number;
    failureCount: number;
  }> {
    if (!body?.tokens || !Array.isArray(body.tokens)) {
      throw new BadRequestException('tokens is required and must be an array');
    }
    if (body.tokens.length === 0) {
      throw new BadRequestException('tokens must contain at least one FCM token');
    }
    if (!body?.notification?.title || !body?.notification?.body) {
      throw new BadRequestException('notification.title and notification.body are required');
    }

    this.logger.log(`Sending bulk notification to ${body.tokens.length} devices`);

    const result = await this.firebaseService.sendToDevices(
      body.tokens,
      body.notification,
      body.data,
    );

    return result;
  }



  /* Validate a single FCM token */
  @Post('validate-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate FCM token',
    description: 'Validates a single FCM token and deactivates it if invalid'
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: ValidateTokenResponseDto
  })
  async validateToken(@Body() validateTokenDto: ValidateTokenDto): Promise<ValidateTokenResponseDto> {
    this.logger.log(`Validating token: ${validateTokenDto.token.slice(0, 12)}...`);
    return await this.firebaseService.validateToken(validateTokenDto.token, validateTokenDto.userId);
  }
}