<script lang="ts">
  import { DATA_MARKS } from '../../reader-core/src/index.ts';

  interface Unserved {
    readonly code: string;
    readonly superseded_by?: string | null;
    readonly reason_message_id?: string | null;
    readonly withdrawn_by_decision_ref?: string | null;
  }

  // Renders the refusal exactly as published. Without a body, the only honest reason is the HTTP status.
  let { unserved = null, httpStatus = null }: { unserved?: Unserved | null; httpStatus?: number | null } = $props();
  const M = DATA_MARKS;
  let code = $derived.by((): string => {
    if (unserved) {
      if (!unserved.code || unserved.code.trim().length === 0) {
        throw new Error('Unserved payload requires a non-empty published code.');
      }
      return unserved.code;
    }
    if (httpStatus === null || httpStatus === undefined) {
      throw new Error('Unserved view requires either a published refusal payload or an HTTP status.');
    }
    return 'http_status_' + String(httpStatus);
  });
</script>

<div class="slip-unserved" role="alert" {...{ [M.part]: 'unserved', [M.state]: 'invalid', [M.reason]: code }}>
  <h2>Publication Unserved</h2>
  <p class="slip-unserved-code">{code}</p>
  {#if unserved?.reason_message_id}
    <p class="slip-unserved-reason">{unserved.reason_message_id}</p>
  {/if}
  {#if unserved?.superseded_by}
    <p class="slip-unserved-supersede">Superseded by: <code>{unserved.superseded_by}</code></p>
  {/if}
  {#if unserved?.withdrawn_by_decision_ref}
    <p class="slip-unserved-decision">
      Decision: <a href={'#' + unserved.withdrawn_by_decision_ref} {...{ [M.proof_ref]: unserved.withdrawn_by_decision_ref }}>{unserved.withdrawn_by_decision_ref}</a>
    </p>
  {/if}
</div>