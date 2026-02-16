/**
 * Password utilities for tuition
 * Provides bcrypt hashing and secure password prompting
 */

import bcrypt from 'bcrypt';
import readline from 'readline';

const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt
 * Compatible with Caddy's basic_auth directive
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a hash
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Prompt for password with hidden input (shows asterisks)
 * @param message - Prompt message to display
 * @returns The entered password
 */
export async function promptPassword(message: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    stdout.write(message);
    stdin.resume();
    stdin.setRawMode(true);
    
    let password = '';
    
    stdin.on('data', (char: Buffer) => {
      const str = char.toString();
      
      // Handle enter key
      if (str === '\n' || str === '\r' || str === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeAllListeners('data');
        stdout.write('\n');
        resolve(password);
        return;
      }
      
      // Handle backspace (DEL)
      if (str === '\b' || str === '\x7f') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }
      
      // Add character, show asterisk
      password += str;
      stdout.write('*');
    });
  });
}
