# Amazon CloudWatch Container Insights Constructs Example

| Required | Environment Key | Example Value(s)            | Description | Default value |
|:--------|:----------------|:----------------------------|:------------|:-----------------------|
| **yes** | `K8S_CLUSTER_NAME` | my-k8s-cluster | The Kubernetes cluster name to enable Container Insights. | --- |
| no | `AWS_REGION` | us-west-2 | The region where your EKS cluster resides. | us-west-2 |
| no | `CI_NAMESPACE` | amazon-cloudwatch | The Kubernetes namespace where you want to use for the Container Insights' agents. | amazon-cloudwatch |
