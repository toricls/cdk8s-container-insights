import { Construct } from 'constructs';
import { BaseParams } from './base-params';
import { ServiceAccount, ClusterRole, ClusterRoleBinding, ConfigMap, DaemonSet } from '../imports/k8s';
import { fluentConf, containersConf, systemdConf, hostConf, confHash } from '../config/fluentd';

export interface LogsOptions extends BaseParams {
    readonly fluentdImageName: string;
}

export default class extends Construct {
    constructor(scope: Construct, name: string, options: LogsOptions) {
        super(scope, name);

        // Creates service account and role binding for cwagent
        const sa = new ServiceAccount(scope, name + '-sa', {
            metadata: {
                name: 'fluentd-sa',
                namespace: options.namespace.name
            }
        })
        const cr = new ClusterRole(scope, name+'-clusterrole', {
            metadata: {
                name: 'fluentd-role'
            },
            rules: [
                {
                    apiGroups: [''],
                    resources: ['namespaces', 'pods', 'pods/logs'],
                    verbs: ['get', 'list', 'watch']
                }
            ]
        });
        new ClusterRoleBinding(scope, name+'-crbinding', {
            metadata: {
                name: 'fluentd-role-binding'
            },
            subjects: [{
                kind: sa.kind,
                name: sa.name,
                namespace: options.namespace.name
            }],
            roleRef: {
                kind: cr.kind,
                name: cr.name,
                // TODO: the following param should be retrieved from the ClusterRole object
                apiGroup: 'rbac.authorization.k8s.io'
            }
        });

        // Creates configmap for fluentd
        let config: { [key: string]: string } = {};
        config['cluster.name'] = options.clusterName;
        config['logs.region'] = options.region;
        const clusterInfo = new ConfigMap(scope, name + '-cm', {
            metadata: {
                name: 'cluster-info',
                namespace: options.namespace.name
            },
            data: config
        });
        let fluentdConfig: { [key: string]: string } = {};
        fluentdConfig['fluent.conf'] = fluentConf;
        fluentdConfig['containers.conf'] = containersConf;
        fluentdConfig['systemd.conf'] = systemdConf;
        fluentdConfig['host.conf'] = hostConf;
        const cm = new ConfigMap(scope, name + '-fluentd-cm', {
            metadata: {
                name: 'fluentd-config',
                namespace: options.namespace.name,
                labels: {
                    'k8s-app': 'fluentd-cwlogs'
                }
            },
            data: fluentdConfig
        });
        // Creates cwagent daemonset
        const daemonsetName = 'fluentd-cwlogs';
        new DaemonSet(scope, name + '-daemonset', {
            metadata: {
                name: daemonsetName,
                namespace: options.namespace.name
            },
            spec: {
                selector: {
                    matchLabels: { 'k8s-app': daemonsetName }
                },
                template: {
                    metadata: {
                        labels: { 'k8s-app': daemonsetName },
                        annotations: { configHash: confHash }
                    },
                    spec: {
                        terminationGracePeriodSeconds: 30,
                        serviceAccountName: sa.name,
                        // Because the image's entrypoint requires to write on /fluentd/etc but we mount configmap there which is read-only,
                        // this initContainers workaround or other is needed.
                        // See https://github.com/fluent/fluentd-kubernetes-daemonset/issues/90
                        initContainers: [
                            {
                                name: 'copy-fluentd-config',
                                image: 'busybox',
                                command: ['sh', '-c', 'cp /config-volume/..data/* /fluentd/etc'],
                                volumeMounts: [
                                    { name: 'config-volume',
                                    mountPath: '/config-volume' },
                                    { name: 'fluentdconf',
                                    mountPath: '/fluentd/etc' }
                                ]
                            },
                            {
                                name: 'update-log-driver',
                                image: 'bosybox',
                                command: ['sh','-c','']
                            }
                        ],
                        containers: [{
                            name: daemonsetName,
                            image: options.fluentdImageName,
                            resources: {
                                limits: {
                                    memory: '400Mi'
                                },
                                requests: {
                                    cpu: '100m',
                                    memory: '200Mi'
                                }
                            },
                            env: [
                                { name: 'REGION',
                                  valueFrom: { configMapKeyRef: { name: clusterInfo.name, key: 'logs.region' }}},
                                { name: 'CLUSTER_NAME',
                                  valueFrom: { configMapKeyRef: { name: clusterInfo.name, key: 'cluster.name' }}},
                                { name: 'CI_VERSION',
                                  value: 'k8s/1.1.0' }
                            ],
                            volumeMounts: [
                                { name: 'config-volume',
                                  mountPath: '/config-volume' },
                                { name: 'fluentdconf',
                                  mountPath: '/fluentd/etc' },
                                { name: 'varlog',
                                  mountPath: '/var/log' },
                                { name: 'varlibdockercontainers',
                                  mountPath: '/var/lib/docker/containers',
                                  readOnly: true },
                                { name: 'runlogjournal',
                                  mountPath: '/run/log/journal',
                                  readOnly: true },
                                { name: 'dmesg',
                                  mountPath: '/var/log/dmesg',
                                  readOnly: true }
                            ]
                        }],
                        volumes: [
                            { name: 'config-volume',
                              configMap: { name: cm.name }},
                            { name: 'fluentdconf',
                              emptyDir: {} },
                            { name: 'varlog',
                              hostPath: { path: '/var/log' }},
                            { name: 'varlibdockercontainers',
                              hostPath: { path: '/var/lib/docker/containers' }},
                            { name: 'runlogjournal',
                              hostPath: { path: '/run/log/journal' }},
                            { name: 'dmesg',
                              hostPath: { path: '/var/log/dmesg' }}
                        ]
                    }
                }
            }
        })
    }
}
