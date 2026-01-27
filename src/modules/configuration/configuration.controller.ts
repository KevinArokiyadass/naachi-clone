import { Body, Controller, Get, Put } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { UpdateConfigurationDto } from './dto/configuration.dto';

@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get()
  async getConfiguration() {
    return this.configurationService.getConfiguration();
  }

  @Put()
  async updateConfiguration(@Body() dto: UpdateConfigurationDto) {
    return this.configurationService.updateConfiguration(dto);
  }
}
