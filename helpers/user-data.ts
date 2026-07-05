import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { appName } from '../config/env';

export interface CreateEc2UserDataProps {
  region: string;
  ecrRepository: ecr.IRepository;
  containerName?: string;
  containerPort?: number;
}

export function createEc2UserData(props: CreateEc2UserDataProps): ec2.UserData {
  const userData = ec2.UserData.forLinux();

  const registry = props.ecrRepository.repositoryUri.split('/')[0];
  const containerName = props.containerName ?? appName;
  const containerPort = props.containerPort ?? 8000;

  userData.addCommands(
    'set -euxo pipefail',

    'dnf update -y',

    'dnf install -y docker docker-compose-plugin git unzip curl jq',

    'systemctl enable docker',

    'systemctl start docker',

    'usermod -aG docker ec2-user',

    `mkdir -p /opt/${appName}`,

    `aws ecr get-login-password --region ${props.region} | docker login --username AWS --password-stdin ${registry}`,

    `docker pull ${props.ecrRepository.repositoryUri}:latest`,

    `docker rm -f ${containerName} || true`,

    `docker run -d --name ${containerName} -p ${containerPort}:${containerPort} --restart unless-stopped ${props.ecrRepository.repositoryUri}:latest`,
  );

  return userData;
}
