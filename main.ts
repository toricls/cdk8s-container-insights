import { Construct } from 'constructs';
import { App, Chart } from 'cdk8s';
import { Namespace } from './imports/k8s';
import { Metrics, Logs } from './container-insights';

interface ContainerInsightsOptions {
    /** 
     * The Kubernetes cluster name to enable Container Insights 
     * @env K8S_CLUSTER_NAME
     * */
    readonly clusterName: string;

    /** 
     * The Kubernetes namespace where the Container Insights' agents to be installed 
     * @env CI_NAMESPACE
     * @default amazon-cloudwatch
     * */
    readonly namespace: string;

    /** 
     * The region code to use CloudWatch services 
     * @env AWS_DEFAULT_REGION
     * @default us-west-2
     * */
    readonly region: string;
}

class ContainerInsights extends Chart {
    constructor(scope: Construct, name: string, options: ContainerInsightsOptions) {
        super(scope, name);

        const ns = new Namespace(this, 'ci-namespace', {
            metadata: {
                name: options.namespace,
                labels: {
                    name: options.namespace
                }
            }
        });

        new Metrics(this, 'ci-metrics', {
            region: options.region,
            clusterName: options.clusterName,
            namespace: ns,
            metricsCollectionInterval: 60,
            forceFlushInterval: 5,
            cwAgentImageName: 'amazon/cloudwatch-agent:1.231221.0'
        });

        new Logs(this, 'ci-logs',{
            region: options.region,
            clusterName: options.clusterName,
            namespace: ns,
            fluentdImageName: 'fluent/fluentd-kubernetes-daemonset:v1.7.3-debian-cloudwatch-1.0'
        });
    }
}

const k8sClusterName = process.env.K8S_CLUSTER_NAME;
if (!k8sClusterName) { throw new Error('K8S_CLUSTER_NAME environment variable is required'); }
const region = process.env.AWS_REGION || 'us-west-2';
const ciNamespace = process.env.CI_NAMESPACE || 'amazon-cloudwatch';

const app = new App();
new ContainerInsights(
    app,
    'cdk8s-container-insights',
    { clusterName: k8sClusterName,
      region: region,
      namespace: ciNamespace }
);
app.synth();
