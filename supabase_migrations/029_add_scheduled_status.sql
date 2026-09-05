-- Migration 029: Add scheduled status to token_status ENUM

ALTER TYPE public.token_status ADD VALUE IF NOT EXISTS 'scheduled';
