import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cdk from 'aws-cdk-lib';
import { appName, env } from '../config/env';

export interface EcrStackProps {
  envName: string;
}

export class EcrStack extends Construct {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id);

    this.repository = new ecr.Repository(this, `${appName}-${props.envName}`, {
      repositoryName: `${appName}-${props.envName}`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      emptyOnDelete: props.envName !== env.prod,

      removalPolicy:
        props.envName === env.prod ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,

      lifecycleRules: [
        {
          maxImageCount: 5,
          description: 'keep last 5 images',
        },
      ],
    });
  }
}
