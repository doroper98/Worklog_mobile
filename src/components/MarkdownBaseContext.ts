import { createContext } from 'react'

/**
 * Directory path within the repo used to resolve relative <img> srcs
 * during markdown rendering. Empty string means the repo root.
 */
export const MarkdownBaseContext = createContext<string>('')
