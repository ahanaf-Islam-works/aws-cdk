import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

import { appName } from '../config/env';

export interface CloudFrontStackProps {
  envName: string;
  frontendBucket: s3.IBucket;
  mediaBucket: s3.IBucket;
  alb: elbv2.ApplicationLoadBalancer;
  certificate?: acm.ICertificate;
  domainNames?: string[];
}

export class CloudFrontStack extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id);
    const frontendOrigin = origins.S3BucketOrigin.withOriginAccessControl(props.frontendBucket);
    const mediaOrigin = origins.S3BucketOrigin.withOriginAccessControl(props.mediaBucket);
    const albOrigin = new origins.HttpOrigin(props.alb.loadBalancerDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    this.distribution = new cloudfront.Distribution(
      this,
      `${appName}-distribution-${props.envName}`,
      {
        comment: `${appName}-${props.envName}`,
        defaultRootObject: 'index.html',
        ...(props.certificate && props.domainNames
          ? { certificate: props.certificate, domainNames: props.domainNames }
          : {}),
        defaultBehavior: {
          origin: frontendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        additionalBehaviors: {
          '/api/*': {
            origin: albOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          },

          '/media/*': {
            origin: mediaOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          },
        },

        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
      },
    );

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
    });

    cdk.Tags.of(this.distribution).add('Project', appName);
    cdk.Tags.of(this.distribution).add('Environment', props.envName);
    cdk.Tags.of(this.distribution).add('ManagedBy', 'AWS CDK');
  }
}
