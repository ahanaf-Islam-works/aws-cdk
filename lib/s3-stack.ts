import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { appName, env, EnvironmentName } from '../config/env';

export interface s3StackProps {
  envName: EnvironmentName;
}

export class S3Stack extends Construct {
  public readonly frontendBucket: s3.Bucket;
  public readonly mediaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: s3StackProps) {
    super(scope, id);

    const isProd = props.envName === env.prod;

    /* The frontend static build output. Nop public access. Cloudfront accessit via origin access control, configured in cloudfront-stack.ts  */
    this.frontendBucket = new s3.Bucket(this, `${appName}-fe-${props.envName}`, {
      bucketName: `${appName}-${props.envName}-frontend`.toLowerCase(),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    /* User-uploaded media files. No public access — CloudFront reads via Origin Access Control. */
    this.mediaBucket = new s3.Bucket(this, `${appName}-media-${props.envName}`, {
      bucketName: `${appName}-${props.envName}-media`.toLowerCase(),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    new cdk.CfnOutput(this, 'ReactBucketName', {
      value: this.frontendBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: this.mediaBucket.bucketName,
    });

    const buckets = [this.frontendBucket, this.mediaBucket];
    buckets.forEach((bucket) => {
      cdk.Tags.of(bucket).add('Project', appName);
      cdk.Tags.of(bucket).add('Environment', props.envName);
      cdk.Tags.of(bucket).add('ManagedBy', 'AWS CDK');
    });
  }
}
