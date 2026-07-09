import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { appName } from '../config/env';

interface VpcStackProps {
  envName: string;
}

export class VpcStack extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'vpc', {
      vpcName: `${appName}-${props.envName}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    cdk.Tags.of(this).add('Project', appName);
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}
