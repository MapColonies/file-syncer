import fs from 'fs';
import { randSentence } from '@ngneat/falso';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../src/common/constants';
import { NFSProvidersConfig } from '../../src/common/interfaces';

@injectable()
export class NfsHelper {
  public constructor(@inject(SERVICES.NFS_CONFIG) private readonly config: NFSProvidersConfig) { 
    if (config.source?.pvPath === undefined) {
      throw new Error('no source pv path');
    }
    fs.mkdirSync(config.source.pvPath);
    if (config.destination?.pvPath === undefined) {
      throw new Error('no destination pv path');
    }
    fs.mkdirSync(config.destination.pvPath);
  }

  public async createFileOfModel(model: string, file: string): Promise<string> {
    if (this.config.source?.pvPath === undefined) {
      throw new Error('no source pv path');
    }
    const fullPath = `${this.config.source.pvPath}/${model}/${file}`;
    const data = randSentence();
    await fs.promises.writeFile(fullPath, data);
    return data;
  }

  public async cleanNFS(): Promise<void> {
    if (this.config.source?.pvPath != undefined) {
      await fs.promises.rm(this.config.source.pvPath, { recursive: true });
    }

    if (this.config.destination?.pvPath != undefined) {
      await fs.promises.rm(this.config.destination.pvPath, { recursive: true });
    }
  }
}
