#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Bytes, Symbol};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CrossChainMsgEvent {
    pub nonce: u64,
    pub sender: Address,
    pub destination_chain: Symbol,
    pub destination_address: String,
    pub payload: Bytes,
}

#[contract]
pub struct CrossChainHandler;

#[contractimpl]
impl CrossChainHandler {
    /// Sends a cross-chain message by emitting a standardized event.
    /// Increments a nonce to prevent replay attacks and provides unique message IDs.
    pub fn send_message(
        env: Env,
        sender: Address,
        destination_chain: Symbol,
        destination_address: String,
        payload: Bytes,
    ) -> u64 {
        sender.require_auth();

        // Increment nonce for replay protection and message identification
        let mut nonce: u64 = env.storage().instance().get(&symbol_short!("nonce")).unwrap_or(0);
        nonce += 1;
        env.storage().instance().set(&symbol_short!("nonce"), &nonce);

        // Emit heavy event including all bridging metadata
        // Topics: [CC_MSG, sender, destination_chain]
        // Data: CrossChainMsgEvent struct
        env.events().publish(
            (symbol_short!("CC_MSG"), sender.clone(), destination_chain.clone()),
            CrossChainMsgEvent {
                nonce,
                sender,
                destination_chain,
                destination_address,
                payload,
            },
        );

        nonce
    }

    /// Returns the current nonce for the contract.
    pub fn get_nonce(env: Env) -> u64 {
        env.storage().instance().get(&symbol_short!("nonce")).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
