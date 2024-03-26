{{/*
Copyright VMware, Inc.
SPDX-License-Identifier: APACHE-2.0
*/}}

{{/* vim: set filetype=mustache: */}}
{{/*
Renders a value that contains template perhaps with scope if the scope is present.
Usage:
{{ include "common.tplvalues.render" ( dict "value" .Values.path.to.the.Value "context" $ ) }}
{{ include "common.tplvalues.render" ( dict "value" .Values.path.to.the.Value "context" $ "scope" $app ) }}
*/}}
{{- define "common.tplvalues.render" -}}
{{- $value := typeIs "string" .value | ternary .value (.value | toYaml) }}
{{- if contains "{{" (toJson .value) }}
  {{- if .scope }}
      {{- tpl (cat "{{- with $.RelativeScope -}}" $value "{{- end }}") (merge (dict "RelativeScope" .scope) .context) }}
  {{- else }}
    {{- tpl $value .context }}
  {{- end }}
{{- else }}
    {{- $value }}
{{- end }}
{{- end -}}

{{/*
Merge a list of values that contains template after rendering them.
Merge precedence is consistent with http://masterminds.github.io/sprig/dicts.html#merge-mustmerge
Usage:
{{ include "common.tplvalues.merge" ( dict "values" (list .Values.path.to.the.Value1 .Values.path.to.the.Value2) "context" $ ) }}
*/}}
{{- define "common.tplvalues.merge" -}}
{{- $dst := dict -}}
{{- range .values -}}
{{- $dst = include "common.tplvalues.render" (dict "value" . "context" $.context "scope" $.scope) | fromYaml | merge $dst -}}
{{- end -}}
{{ $dst | toYaml }}
{{- end -}}

{{/*
End of usage example
*/}}

{{/*
Custom definitions
*/}}

{{- define "common.splunk.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.splunk .Values.global.ingestion.splunk ) "context" . ) }}
{{- end -}}

{{- define "common.providers.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.providers .Values.global.ingestion.providers ) "context" . ) }}
{{- end -}}

{{- define "common.NFS.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.NFS .Values.global.ingestion.NFS ) "context" . ) }}
{{- end -}}



{{- define "common.ca.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ca .Values.global.ca ) "context" . ) }}
{{- end -}}

{{- define "common.S3-destination.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.S3.destination .Values.global.S3.destination ) "context" . ) }}
{{- end -}}

{{- define "common.S3-source.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.S3.source .Values.global.S3.source ) "context" . ) }}
{{- end -}}

{{- define "common.job-manager.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.jobManager .Values.global.ingestion.jobManager ) "context" . ) }}
{{- end -}}

{{- define "common.job.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.job .Values.global.ingestion.job ) "context" . ) }}
{{- end -}}

{{- define "common.task.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.task .Values.global.ingestion.task ) "context" . ) }}
{{- end -}}

{{- define "common.heart-beat.merged" -}}
{{- include "common.tplvalues.merge" ( dict "values" ( list .Values.ingestion.heartbeat .Values.global.ingestion.heartbeat ) "context" . ) }}
{{- end -}}

