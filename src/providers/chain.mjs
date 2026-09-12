import { CHAIN } from '../config.mjs';
import { rpc } from './http.mjs';

/** Chain health. Reports what it could not read instead of guessing. */
export async function health(url = CHAIN.rpc) {
  const id = await rpc(url, 'eth_chainId');
  const head = await rpc(url, 'eth_blockNumber');
  return {
    url,
    reachable: id.ok,
    chainId: id.ok ? Number.parseInt(id.data, 16) : null,
    expectedChainId: CHAIN.id,
    matches: id.ok ? Number.parseInt(id.data, 16) === CHAIN.id : null,
    block: head.ok ? Number.parseInt(head.data, 16) : null,
    error: id.ok ? (head.ok ? null : head.error) : id.error
  };
}
