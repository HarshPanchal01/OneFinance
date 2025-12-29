<template>
  <div class="h-screen flex flex-col">
  <header class ="flex items-center justify-between px-4 h-14 bg-slate-80 text-black">
    <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Accounts
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          <span>All Accounts</span>
          ({{accountArray.length}})
        </p>
      </div>
    <button class="inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors" @click="addAccount">
      <i class="pi pi-plus mr-2" /> 
      {{ buttonText }}
    </button>
  </header>

  <AccountListView
    :accountArray="accountArray"
    @select="editAccount"
    class="flex-1 overflow-auto"
    />
  </div>


</template>

<script setup lang="ts">
//import { ref } from 'vue';
//import { useFinanceStore } from '@/stores/finance';
import AccountListView from './components/AccountListView.vue';

const title = 'Accounts';
//const store = useFinanceStore();
const buttonText = "New Account"

const accountArray = [
  {id: 1, accountName: "James College Fund", balance: 56748},
  {id: 2, accountName: "James Rainy Day", balance: 5000},
  {id: 3, accountName: "James Savings", balance: 22012}
]

function editAccount(){
  console.log("edit button clicked")
}

function addAccount(){
  console.log("add account button pressed")
}


</script>

<style scoped>
/* optional styles */
</style>