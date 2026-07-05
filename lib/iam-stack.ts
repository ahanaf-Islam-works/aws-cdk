import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { appName } from '../config/env';
export interface IamStackProps {
  envName: string;
}

export class IamStack extends Construct {
  public readonly user: iam.User;
  public readonly accessKey: iam.CfnAccessKey;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id);

    this.user = new iam.User(this, `${appName}-IamUser-${props.envName}`, {
      userName: `${appName}-${props.envName}-user`,
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
    });

    cdk.Tags.of(this.user).add('Name', `${appName}-${props.envName}-user`);
    cdk.Tags.of(this.user).add('project', `${appName}-${props.envName}`);

    this.accessKey = new iam.CfnAccessKey(this, `${appName}-${props.envName}`, {
      userName: this.user.userName,
    });
  }
}
