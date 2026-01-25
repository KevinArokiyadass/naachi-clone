import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { IConfiguration } from 'src/common/interfaces/configuration.interface';

@Injectable()
export class ConfigurationService implements OnApplicationBootstrap {
  constructor(private readonly dbService: IMongoDBServices) {}

  async onApplicationBootstrap() {
 
  }

  async getConfiguration(): Promise<IConfiguration> {
    let config = await this.dbService.configuration.findOne({});
    
    // If no configuration exists, return defaults
    if (!config) {
      return {
        allowedUserCount: 500,
        forceRestrictOnboarding: false,
      };
    }

    return config;
  }

  async updateConfiguration(updateData: { allowedUserCount?: number; forceRestrictOnboarding?: boolean }): Promise<IConfiguration> {
    let config = await this.dbService.configuration.findOne({});
    
    if (!config) {
      // Create new configuration if it doesn't exist
      const newConfig = {
        allowedUserCount: updateData.allowedUserCount ?? 500,
        forceRestrictOnboarding: updateData.forceRestrictOnboarding ?? false,
      };
      return await this.dbService.configuration.create(newConfig);
    }

    // Update existing configuration
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (updateData.allowedUserCount !== undefined) {
      updatePayload.allowedUserCount = updateData.allowedUserCount;
    }

    if (updateData.forceRestrictOnboarding !== undefined) {
      updatePayload.forceRestrictOnboarding = updateData.forceRestrictOnboarding;
    }

    return await this.dbService.configuration.findOneAndUpdate(
      {},
      updatePayload,
      { new: true },
    );
  }
}
