#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { MainStack } from '../lib/cdk-stack';
import { appName, getEnvironmentConfig } from '../config/env';

const app = new cdk.App();
const envName = app.node.tryGetContext('env') || 'dev';

const config = getEnvironmentConfig(envName);

new MainStack(app, `${config.envName}-${appName}`, {
  envName: config.envName,

  env: {
    account: config.account,
    region: config.region,
  },

  description: `${appName.toLocaleUpperCase()} Infrastructure (${config.envName})`,
});
