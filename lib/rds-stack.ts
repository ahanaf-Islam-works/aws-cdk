import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { appName, env, EnvironmentName } from '../config/env';

export interface RdsPostgresStackProps {
  envName: EnvironmentName;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  dbName: string;
  dbUserName: string;
}

export class RdsPostgres extends Construct {
  public readonly database: rds.DatabaseInstance;
  public readonly dbSecret: rds.DatabaseSecret;
  public readonly userName: string;
  public readonly dbName: string;
  public readonly host: string;
  public readonly port: string;
  public readonly secretName: string;

  constructor(scope: Construct, id: string, props: RdsPostgresStackProps) {
    super(scope, id);

    this.userName = props.dbUserName;
    this.dbName = props.dbName;
    this.dbSecret = new rds.DatabaseSecret(this, `${appName}-postgres-secret-${props.envName}`, {
      username: this.userName,
    });

    this.database = new rds.DatabaseInstance(this, `${appName}-postgres-${props.envName}`, {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17,
      }),

      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),

      allocatedStorage: 20,
      maxAllocatedStorage: 100,

      storageEncrypted: true,

      vpc: props.vpc,

      securityGroups: [props.securityGroup],

      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },

      credentials: rds.Credentials.fromSecret(this.dbSecret),

      databaseName: this.dbName,

      publiclyAccessible: false,

      multiAz: false,

      backupRetention: cdk.Duration.days(props.envName === env.prod ? 7 : 1),

      deletionProtection: props.envName === env.prod,

      removalPolicy:
        props.envName === env.prod ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // aws secretsmanager get-secret-value \ --secret-id <secret-name-from-output> for getting secrets
    this.host = this.database.dbInstanceEndpointAddress;
    this.port = this.database.dbInstanceEndpointPort;
    this.secretName = this.dbSecret.secretName;
    this.secretName = this.dbSecret.secretName;

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.host,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.port,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: this.dbName,
    });

    cdk.Tags.of(this.database).add('Project', appName);
    cdk.Tags.of(this.database).add('Environment', props.envName);
    cdk.Tags.of(this.database).add('ManagedBy', 'AWS CDK');
  }
}
