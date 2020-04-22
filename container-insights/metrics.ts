import { Construct } from 'constructs';
import { BaseParams } from './base-params';
import { ServiceAccount, ClusterRole, ClusterRoleBinding, ConfigMap, DaemonSet } from '../imports/k8s';

export interface MetricsOptions extends BaseParams {
    /**
     * How often the agent collects metrics. The default is 60 seconds.
     * The default cadvisor collection interval in kubelet is 15 seconds, 
     * so don't set this value to less than 15 seconds.
     * @default 60
     */
    readonly metricsCollectionInterval?: number;

    /**
     * The interval for batching metrics before they are published.
     * The default is 5 seconds.
     * @default 5
     */
    readonly forceFlushInterval?: number;

    readonly cwAgentImageName: string;
}

export default class extends Construct {
    constructor(scope: Construct, name: string, options: MetricsOptions) {
        super(scope, name);

        const metricsCollectionInterval = options.metricsCollectionInterval || 60;
        const forceFlushInterval = options.forceFlushInterval || 5;

        // Creates service account and role binding for cwagent
        const sa = new ServiceAccount(scope, name + '-sa', {
            metadata: {
                name: 'cwagent-sa',
                namespace: options.namespace.name
            }
        })
        const cr = new ClusterRole(scope, name+'-clusterrole', {
            metadata: {
                name: 'cwagent-role'
            },
            rules: [
                {
                    apiGroups: [''],
                    resources: ['pods', 'nodes', 'endpoints'],
                    verbs: ['list', 'watch']
                },
                {
                    apiGroups: ['apps'],
                    resources: ['replicasets'],
                    verbs: ['list', 'watch']
                },
                {
                    apiGroups: ['batch'],
                    resources: ['jobs'],
                    verbs: ['list', 'watch']
                },
                {
                    apiGroups: [''],
                    resources: ['nodes/proxy'],
                    verbs: ['get']
                },
                {
                    apiGroups: [''],
                    resources: ['nodes/stats', 'configmaps', 'events'],
                    verbs: ['create']
                },
                {
                    apiGroups: [''],
                    resources: ['configmaps'],
                    resourceNames: ['cwagent-clusterleader'],
                    verbs: ['get', 'update']
                }
            ]
        });
        new ClusterRoleBinding(scope, name+'-crbinding', {
            metadata: {
                name: 'cwagent-role-binding'
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

        // Creates configmap for cwagent
        let config : { [key: string]: string } = {};
        config['cwagentconfig.json'] = [
            '{',
                '"logs": {',
                    '"metrics_collected": {',
                        '"kubernetes": {',
                            '"cluster_name": "' + options.clusterName + '",',
                            '"metrics_collection_interval":' + metricsCollectionInterval + ',',
                        '}',
                  '}',
                  '"force_flush_interval":' + forceFlushInterval + ',',
                '}',
            '}'
        ].join('\n')
        const cm = new ConfigMap(scope, name + '-cm', {
            metadata: {
                name: 'cwagent-cm',
                namespace: options.namespace.name
            },
            data: config
        });

        // Creates cwagent daemonset
        const daemonsetName = 'cwagent';
        new DaemonSet(scope, name + '-daemonset', {
            metadata: {
                name: daemonsetName,
                namespace: options.namespace.name
            },
            spec: {
                selector: {
                    matchLabels: {
                        name: daemonsetName
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            name: daemonsetName
                        }
                    },
                    spec: {
                        terminationGracePeriodSeconds: 60,
                        serviceAccountName: sa.name,
                        containers: [{
                            name: daemonsetName,
                            image: options.cwAgentImageName,
                            resources: {
                                limits: {
                                    cpu: '200m',
                                    memory: '200Mi'
                                },
                                requests: {
                                    cpu: '200m',
                                    memory: '200Mi'
                                }
                            },
                            // DO NOT CHANGE BELOW ENVS
                            env: [
                                { name: 'HOST_IP',
                                  valueFrom: { fieldRef: { fieldPath: 'status.hostIP' }}},
                                { name: 'HOST_NAME',
                                  valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' }}},
                                { name: 'K8S_NAMESPACE',
                                  valueFrom: { fieldRef: { fieldPath: 'metadata.namespace' }}},
                                { name: 'CI_VERSION',
                                  value: 'k8s/1.1.0' }
                            ],
                            // DO NOT CHANGE THE mountPath
                            volumeMounts: [
                                { name: 'cwagentconfig',
                                  mountPath: '/etc/cwagentconfig' },
                                { name: 'rootfs',
                                  mountPath: '/rootfs',
                                  readOnly: true },
                                { name: 'dockersock',
                                  mountPath: '/var/run/docker.sock',
                                  readOnly: true },
                                { name: 'varlibdocker',
                                  mountPath: '/var/lib/docker',
                                  readOnly: true },
                                { name: 'sys',
                                  mountPath: '/sys',
                                  readOnly: true },
                                { name: 'devdisk',
                                  mountPath: '/dev/disk',
                                  readOnly: true }
                            ]
                        }],
                        volumes: [
                            { name: 'cwagentconfig',
                              configMap: { name: cm.name }},
                            { name: 'rootfs',
                              hostPath: { path: '/' }},
                            { name: 'dockersock',
                              hostPath: { path: '/var/run/docker.sock' }},
                            { name: 'varlibdocker',
                              hostPath: { path: '/var/lib/docker' }},
                            { name: 'sys',
                              hostPath: { path: '/sys' }},
                            { name: 'devdisk',
                              hostPath: { path: '/dev/disk/' }}
                        ]
                    }
                }
            }
        })
    }
}
