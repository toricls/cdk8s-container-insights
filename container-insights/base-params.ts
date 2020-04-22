import { Namespace } from '../imports/k8s'

export interface BaseParams {
    /** The Kubernetes cluster name to enable Container Insights */
    readonly clusterName: string;

    /** The Kubernetes namespace where the Container Insights' agents to be installed */
    readonly namespace: Namespace;

    /** The region code to use CloudWatch services */
    readonly region: string;
}
