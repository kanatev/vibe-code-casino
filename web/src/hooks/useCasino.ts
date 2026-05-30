import { useAccount, useReadContracts } from 'wagmi'
import { casinoContract, chipContract, CASINO_ADDRESS, isConfigured } from '../config'

/** Aggregated on-chain reads for the connected player + the house. */
export function useCasino() {
  const { address } = useAccount()

  const query = useReadContracts({
    allowFailure: true,
    contracts: [
      { ...chipContract, functionName: 'balanceOf', args: [address ?? '0x0'] },
      { ...chipContract, functionName: 'allowance', args: [address ?? '0x0', CASINO_ADDRESS] },
      { ...chipContract, functionName: 'timeUntilNextClaim', args: [address ?? '0x0'] },
      { ...casinoContract, functionName: 'balanceOf', args: [address ?? '0x0'] },
      { ...casinoContract, functionName: 'pendingRequestId', args: [address ?? '0x0'] },
      { ...casinoContract, functionName: 'houseBankroll' },
    ],
    query: {
      enabled: Boolean(address) && isConfigured,
      // Poll so the async VRF settlement and balances stay fresh.
      refetchInterval: 4000,
    },
  })

  const r = query.data
  const val = (i: number) => (r?.[i]?.status === 'success' ? (r[i].result as bigint) : undefined)

  return {
    walletBalance: val(0),
    allowance: val(1),
    faucetCooldown: val(2),
    casinoBalance: val(3),
    pendingRequestId: val(4),
    houseBankroll: val(5),
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
