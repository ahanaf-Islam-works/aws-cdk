import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cdk from 'aws-cdk-lib';
import { appName } from '../config/env';

export interface IamStackProps {
  envName: string;
  ecrRepository: ecr.IRepository;
  dbSecret: secretsmanager.ISecret;
  mediaBucket: s3.IBucket;
}

export class IamStack extends Construct {
  public readonly instanceRole: iam.Role;
  public readonly executionRole: iam.Role;
  public readonly taskRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    this.instanceRole = new iam.Role(this, `${appName}-ecs-host-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-ecs-host-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceforEC2Role',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    this.executionRole = new iam.Role(this, `${appName}-task-exec-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-task-execution-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    props.ecrRepository.grantPull(this.executionRole);
    props.dbSecret.grantRead(this.executionRole);

    this.executionRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:GetParametersByPath',
          'ssm:DescribeParameters',
        ],
        resources: [`arn:aws:ssm:${region}:${account}:parameter/${appName}/${props.envName}/*`],
      }),
    );

    this.taskRole = new iam.Role(this, `${appName}-task-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-task-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    props.mediaBucket.grantReadWrite(this.taskRole);
    props.dbSecret.grantRead(this.taskRole);

    this.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [`arn:aws:lambda:${region}:${account}:function:contract-checker-*`],
      }),
    );

    this.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [`arn:aws:ssm:${region}:${account}:parameter/${appName}/${props.envName}/*`],
      }),
    );

    new cdk.CfnOutput(this, 'SharedDbSecretArn', {
      value: props.dbSecret.secretArn,
      exportName: `${appName}-${props.envName}-DbSecretArn`,
    });

    cdk.Tags.of(this).add('Project', appName);
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}
