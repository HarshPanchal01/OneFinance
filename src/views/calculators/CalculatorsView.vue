<script setup lang="ts">
import CompoundInterestCalculator from './components/CompoundInterestCalculator.vue';
import LoanMortgageCalculator from './components/LoanMortgageCalculator.vue';
</script>

<template>
  <div class="h-full flex flex-col gap-6 overflow-y-auto pr-2 pb-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Financial Calculators
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Plan your financial future, project investment growth, and simulate debt payoffs.
      </p>
    </div>

    <!-- Calculators Stack -->
    <div class="flex flex-col gap-8">
      <CompoundInterestCalculator />
      <LoanMortgageCalculator />
    </div>
  </div>
</template>
